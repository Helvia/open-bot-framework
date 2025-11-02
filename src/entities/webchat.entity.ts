import { WebChatChannelDto } from 'src/dto/webchat.dto';
import { Entity, ManyToOne, JoinColumn, Column, CreateDateColumn, Index, PrimaryColumn } from 'typeorm';
import { OpenBot } from './openbot.entity';

@Entity()
export class WebChatChannel {
    @PrimaryColumn()
    id: string;

    @ManyToOne(() => OpenBot, { onDelete: 'CASCADE' })
    @JoinColumn()
    openBot: OpenBot;

    @Column()
    name: string;

    @Column()
    @Index()
    secret1: string;

    @Column()
    @Index()
    secret2: string;

    @CreateDateColumn()
    createdAt: Date;

    toDto(): WebChatChannelDto {
        return {
            id: this.id,
            name: this.name,
            createdAt: this.createdAt,
            secret1: this.secret1,
            secret2: this.secret2
        };
    }
}
